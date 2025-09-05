const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

class QueryRepository {
  constructor() {
    this.db = null;
    this.initDatabase();
  }

  initDatabase() {
    try {
      // Store database in userData directory
      const dbPath = path.join(app.getPath('userData'), 'ml-console-queries.db');
      console.log('Initializing database at:', dbPath);
      
      this.db = new Database(dbPath);
      
      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      
      // Create tables
      this.createTables();
      
      // Prepare statements for better performance
      this.prepareStatements();
      
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  createTables() {
    // Main queries table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        query_type TEXT NOT NULL CHECK(query_type IN ('xquery', 'javascript', 'sparql', 'optic')),
        database_name TEXT,
        version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        embedding BLOB,
        execution_time_ms INTEGER,
        status TEXT DEFAULT 'saved' CHECK(status IN ('saved', 'executed', 'failed'))
      );
    `);

    // Full-text search table
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS query_fts USING fts5(
        content, 
        query_type, 
        database_name,
        content='queries',
        content_rowid='id'
      );
    `);

    // Indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_queries_type_time ON queries(query_type, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_queries_database_time ON queries(database_name, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_queries_status_time ON queries(status, created_at DESC);
    `);

    // Trigger to keep FTS table in sync
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS query_fts_insert AFTER INSERT ON queries BEGIN
        INSERT INTO query_fts(rowid, content, query_type, database_name) 
        VALUES (new.id, new.content, new.query_type, new.database_name);
      END;
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS query_fts_delete AFTER DELETE ON queries BEGIN
        DELETE FROM query_fts WHERE rowid = old.id;
      END;
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS query_fts_update AFTER UPDATE ON queries BEGIN
        DELETE FROM query_fts WHERE rowid = old.id;
        INSERT INTO query_fts(rowid, content, query_type, database_name) 
        VALUES (new.id, new.content, new.query_type, new.database_name);
      END;
    `);
  }

  prepareStatements() {
    // Prepared statements for common operations
    this.statements = {
      insertQuery: this.db.prepare(`
        INSERT INTO queries (content, query_type, database_name, embedding, execution_time_ms, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `),
      
      getRecentQueries: this.db.prepare(`
        SELECT id, content, query_type, database_name, version, created_at, updated_at, 
               execution_time_ms, status,
               SUBSTR(content, 1, 100) || CASE WHEN LENGTH(content) > 100 THEN '...' ELSE '' END as preview
        FROM queries 
        ORDER BY created_at DESC 
        LIMIT ?
      `),
      
      getQueryById: this.db.prepare(`
        SELECT * FROM queries WHERE id = ?
      `),
      
      searchQueries: this.db.prepare(`
        SELECT q.id, q.content, q.query_type, q.database_name, q.version, 
               q.created_at, q.updated_at, q.execution_time_ms, q.status,
               SUBSTR(q.content, 1, 100) || CASE WHEN LENGTH(q.content) > 100 THEN '...' ELSE '' END as preview
        FROM queries q
        JOIN query_fts fts ON q.id = fts.rowid
        WHERE query_fts MATCH ?
        ORDER BY q.created_at DESC
        LIMIT ?
      `),
      
      getQueriesByType: this.db.prepare(`
        SELECT id, content, query_type, database_name, version, created_at, updated_at,
               execution_time_ms, status,
               SUBSTR(content, 1, 100) || CASE WHEN LENGTH(content) > 100 THEN '...' ELSE '' END as preview
        FROM queries 
        WHERE query_type = ?
        ORDER BY created_at DESC 
        LIMIT ?
      `),
      
      updateQueryStatus: this.db.prepare(`
        UPDATE queries 
        SET status = ?, execution_time_ms = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      
      deleteQuery: this.db.prepare(`
        DELETE FROM queries WHERE id = ?
      `)
    };
  }

  // Save a new query
  saveQuery(content, queryType, databaseName, embedding = null, executionTimeMs = null, status = 'saved') {
    try {
      const result = this.statements.insertQuery.run(
        content, 
        queryType, 
        databaseName, 
        embedding ? Buffer.from(embedding) : null,
        executionTimeMs,
        status
      );
      
      console.log(`Saved query with ID: ${result.lastInsertRowid}`);
      return {
        success: true,
        id: result.lastInsertRowid,
        changes: result.changes
      };
    } catch (error) {
      console.error('Error saving query:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get recent queries (default 15)
  getRecentQueries(limit = 15) {
    try {
      const queries = this.statements.getRecentQueries.all(limit);
      return {
        success: true,
        queries: queries.map(this.formatQuery)
      };
    } catch (error) {
      console.error('Error getting recent queries:', error);
      return {
        success: false,
        error: error.message,
        queries: []
      };
    }
  }

  // Get query by ID
  getQueryById(id) {
    try {
      const query = this.statements.getQueryById.get(id);
      return {
        success: true,
        query: query ? this.formatQuery(query) : null
      };
    } catch (error) {
      console.error('Error getting query by ID:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Search queries using full-text search
  searchQueries(searchTerm, limit = 15) {
    try {
      const queries = this.statements.searchQueries.all(searchTerm, limit);
      return {
        success: true,
        queries: queries.map(this.formatQuery)
      };
    } catch (error) {
      console.error('Error searching queries:', error);
      return {
        success: false,
        error: error.message,
        queries: []
      };
    }
  }

  // Get queries by type
  getQueriesByType(queryType, limit = 15) {
    try {
      const queries = this.statements.getQueriesByType.all(queryType, limit);
      return {
        success: true,
        queries: queries.map(this.formatQuery)
      };
    } catch (error) {
      console.error('Error getting queries by type:', error);
      return {
        success: false,
        error: error.message,
        queries: []
      };
    }
  }

  // Update query execution status
  updateQueryStatus(id, status, executionTimeMs = null) {
    try {
      const result = this.statements.updateQueryStatus.run(status, executionTimeMs, id);
      return {
        success: true,
        changes: result.changes
      };
    } catch (error) {
      console.error('Error updating query status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Delete query
  deleteQuery(id) {
    try {
      const result = this.statements.deleteQuery.run(id);
      return {
        success: true,
        changes: result.changes
      };
    } catch (error) {
      console.error('Error deleting query:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Format query object for frontend
  formatQuery(query) {
    return {
      id: query.id,
      content: query.content,
      preview: query.preview,
      queryType: query.query_type,
      databaseName: query.database_name,
      version: query.version,
      createdAt: query.created_at,
      updatedAt: query.updated_at,
      executionTimeMs: query.execution_time_ms,
      status: query.status,
      hasEmbedding: !!query.embedding
    };
  }

  // Vector similarity search (placeholder for future implementation)
  findSimilarQueries(embedding, limit = 10) {
    // TODO: Implement vector similarity search
    // For now, return empty results
    return {
      success: true,
      queries: []
    };
  }

  // Get database statistics
  getStats() {
    try {
      const stats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_queries,
          COUNT(CASE WHEN query_type = 'xquery' THEN 1 END) as xquery_count,
          COUNT(CASE WHEN query_type = 'javascript' THEN 1 END) as javascript_count,
          COUNT(CASE WHEN query_type = 'sparql' THEN 1 END) as sparql_count,
          COUNT(CASE WHEN query_type = 'optic' THEN 1 END) as optic_count,
          COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as embedded_queries,
          MAX(created_at) as last_query_time
        FROM queries
      `).get();

      return {
        success: true,
        stats
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
      console.log('Database connection closed');
    }
  }
}

module.exports = QueryRepository;