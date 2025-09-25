import React from 'react';

/**
 * DatabaseSelector Component
 *
 * A focused component for selecting query type and database configuration.
 * Provides dropdowns for both query type and database selection with appropriate labels.
 *
 * Features:
 * - Query type selection (XQuery, JavaScript, SPARQL)
 * - Database configuration selection with display names
 * - Disabled states when no databases are available
 * - Proper labeling and accessibility
 * - Compact form layout suitable for navbar placement
 *
 * @param {Object} props Component props
 * @param {string} props.queryType Current query type
 * @param {Function} props.onQueryTypeChange Callback when query type changes
 * @param {string} props.selectedDatabaseId Current selected database ID
 * @param {Function} props.onDatabaseChange Callback when database selection changes
 * @param {Array} props.databaseConfigs Array of available database configurations
 * @param {Object} props.currentDatabaseConfigRef Ref for current database config
 * @returns {JSX.Element} DatabaseSelector component
 */
export default function DatabaseSelector({
  queryType = 'xquery',
  onQueryTypeChange,
  selectedDatabaseId = '',
  onDatabaseChange,
  databaseConfigs = [],
  currentDatabaseConfigRef
}) {

  // Handle database selection change
  const handleDatabaseChange = (e) => {
    const selectedId = e.target.value;
    const config = databaseConfigs.find(c => c.id === selectedId);

    if (config) {
      onDatabaseChange(config);
      // Update the ref immediately for consistent access
      if (currentDatabaseConfigRef && currentDatabaseConfigRef.current !== undefined) {
        currentDatabaseConfigRef.current = config;
      }
    }
  };

  // Query type options
  const queryTypeOptions = [
    { value: 'xquery', label: 'XQuery' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'sparql', label: 'SPARQL' }
  ];

  // Check if databases are available
  const hasDatabases = databaseConfigs.length > 0;

  return (
    <div className="flex items-center gap-4">
      {/* Query Type Selector */}
      <div className="form-control">
        <label className="label">
          <span className="label-text text-sm font-medium">Query Type</span>
        </label>
        <select
          className="select select-bordered select-sm w-32"
          value={queryType}
          onChange={(e) => onQueryTypeChange(e.target.value)}
          aria-label="Select query type"
        >
          {queryTypeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Database Selector */}
      <div className="form-control">
        <label className="label">
          <span className="label-text text-sm font-medium">Database</span>
        </label>
        <select
          className="select select-bordered select-sm w-64"
          value={selectedDatabaseId}
          onChange={handleDatabaseChange}
          disabled={!hasDatabases}
          aria-label="Select database"
        >
          {!hasDatabases ? (
            <option value="">No databases available - check connection</option>
          ) : (
            databaseConfigs.map((config, index) => (
              <option
                key={`db-${index}-${config.id}`}
                value={config.id}
                title={`Database: ${config.name}, Modules: ${config.modulesDatabase}`}
              >
                {config.name} ({config.modulesDatabase})
              </option>
            ))
          )}
        </select>

        {/* Connection Status Hint */}
        {!hasDatabases && (
          <label className="label">
            <span className="label-text-alt text-warning">
              Check server connection and credentials
            </span>
          </label>
        )}
      </div>
    </div>
  );
}