import { useCallback, useReducer } from 'react';
import { readStreamParts } from '../ipc/queryClient';

const STREAM_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  COMPLETE: 'complete',
  ERROR: 'error',
  STATIC: 'static',
};

const initialState = (pageSize) => ({
  mode: 'idle',
  streamStatus: STREAM_STATUS.IDLE,
  index: null,
  records: [],
  activeRecordIndex: 0,
  error: null,
  totalRecords: 0,
  pagination: {
    currentPage: 0,
    pageSize,
    start: 0,
    totalPages: 0,
  },
});

const reducer = (state, action) => {
  switch (action.type) {
    case 'RESET':
      return initialState(state.pagination.pageSize);
    case 'LOAD_STATIC': {
      const totalRecords = action.records.length;
      const totalPages = totalRecords === 0
        ? 0
        : Math.ceil(totalRecords / state.pagination.pageSize);
      return {
        ...state,
        mode: 'static',
        streamStatus: STREAM_STATUS.STATIC,
        index: null,
        records: action.records,
        totalRecords,
        pagination: {
          ...state.pagination,
          currentPage: 0,
          start: 0,
          totalPages,
        },
        activeRecordIndex: 0,
        error: null,
      };
    }
    case 'INIT_STREAM': {
      const totalRecords = action.totalRecords ?? 0;
      const totalPages = totalRecords === 0
        ? 0
        : Math.ceil(totalRecords / state.pagination.pageSize);
      return {
        ...state,
        mode: 'stream',
        streamStatus: STREAM_STATUS.LOADING,
        index: action.index,
        totalRecords,
        pagination: {
          ...state.pagination,
          currentPage: 0,
          start: 0,
          totalPages,
        },
        records: [],
        activeRecordIndex: 0,
        error: null,
      };
    }
    case 'SET_PAGE': {
      return {
        ...state,
        streamStatus: STREAM_STATUS.READY,
        records: action.records,
        pagination: {
          ...state.pagination,
          currentPage: action.currentPage,
          start: action.start,
        },
        activeRecordIndex: 0,
        error: null,
      };
    }
    case 'COMPLETE_STREAM':
      return { ...state, streamStatus: STREAM_STATUS.COMPLETE };
    case 'SET_ERROR':
      return { ...state, streamStatus: STREAM_STATUS.ERROR, error: action.error };
    case 'SET_ACTIVE_RECORD':
      return { ...state, activeRecordIndex: action.index };
    default:
      return state;
  }
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function useStreamingResults({
  pageSize = 50,
  onStart,
  onChunk,
  onComplete,
  onError,
  readParts = readStreamParts,
} = {}) {
  const [state, dispatch] = useReducer(reducer, pageSize, initialState);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const setActiveRecordIndex = useCallback((index) => {
    const nextIndex = clamp(index, 0, Math.max(state.records.length - 1, 0));
    dispatch({ type: 'SET_ACTIVE_RECORD', index: nextIndex });
    return nextIndex;
  }, [state.records.length]);

  const loadStaticRecords = useCallback((records = []) => {
    dispatch({ type: 'LOAD_STATIC', records });
    if (onComplete) {
      onComplete({ mode: 'static', records });
    }
  }, [onComplete]);

  const loadPage = useCallback(async (pageIndex, indexOverride) => {
    const index = indexOverride ?? state.index;
    if (!index) {
      throw new Error('No stream index available for pagination');
    }

    const start = pageIndex * state.pagination.pageSize;
    try {
      const result = await readParts(index.dir, start, state.pagination.pageSize);
      dispatch({ type: 'SET_PAGE', records: result.records || [], currentPage: pageIndex, start });
      if (onChunk) {
        onChunk({ start, records: result.records || [] });
      }
      return result.records || [];
    } catch (error) {
      dispatch({ type: 'SET_ERROR', error });
      if (onError) onError(error);
      throw error;
    }
  }, [state.index, state.pagination.pageSize, readParts, onChunk, onError]);

  const initializeStream = useCallback(async (index) => {
    const totalRecords = (index?.parts || []).length;
    dispatch({ type: 'INIT_STREAM', index, totalRecords });
    if (onStart) onStart({ index, totalRecords });
    await loadPage(0, index);
  }, [loadPage, onStart]);

  const nextPage = useCallback(async () => {
    const nextPageIndex = state.pagination.currentPage + 1;
    if (nextPageIndex * state.pagination.pageSize >= state.totalRecords) {
      return state.pagination.currentPage;
    }
    await loadPage(nextPageIndex);
    return nextPageIndex;
  }, [state.pagination.currentPage, state.pagination.pageSize, state.totalRecords, loadPage]);

  const prevPage = useCallback(async () => {
    const prevPageIndex = Math.max(state.pagination.currentPage - 1, 0);
    if (prevPageIndex === state.pagination.currentPage) return prevPageIndex;
    await loadPage(prevPageIndex);
    return prevPageIndex;
  }, [state.pagination.currentPage, loadPage]);

  const jumpToPage = useCallback(async (pageIndex) => {
    const targetPage = clamp(pageIndex, 0, Math.max(state.pagination.totalPages - 1, 0));
    await loadPage(targetPage);
    return targetPage;
  }, [state.pagination.totalPages, loadPage]);

  const goToNextRecord = useCallback(() => {
    const nextIndex = clamp(state.activeRecordIndex + 1, 0, Math.max(state.records.length - 1, 0));
    dispatch({ type: 'SET_ACTIVE_RECORD', index: nextIndex });
    return nextIndex;
  }, [state.activeRecordIndex, state.records.length]);

  const goToPrevRecord = useCallback(() => {
    const nextIndex = clamp(state.activeRecordIndex - 1, 0, Math.max(state.records.length - 1, 0));
    dispatch({ type: 'SET_ACTIVE_RECORD', index: nextIndex });
    return nextIndex;
  }, [state.activeRecordIndex, state.records.length]);

  const markComplete = useCallback(() => {
    dispatch({ type: 'COMPLETE_STREAM' });
    if (onComplete) onComplete({ mode: state.mode, records: state.records });
  }, [onComplete, state.mode, state.records]);

  return {
    state,
    reset,
    initializeStream,
    loadStaticRecords,
    nextPage,
    prevPage,
    jumpToPage,
    goToNextRecord,
    goToPrevRecord,
    setActiveRecordIndex,
    markComplete,
  };
}

export { STREAM_STATUS };
