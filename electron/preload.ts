import { contextBridge, ipcRenderer } from 'electron';

const paths = ipcRenderer.sendSync('get-model-paths-sync');

declare global {
  interface Window {
    __MODELS_DIR__: string;
    __WASM_DIR__: string;
    electronAPI: {
      getModelPaths: () => Promise<{ modelsDir: string; wasmDir: string }>;
      llm: {
        status: () => Promise<any>;
        update: (status: any) => void;
      };
    };
  }
}

contextBridge.exposeInMainWorld('__MODELS_DIR__', paths.modelsDir);
contextBridge.exposeInMainWorld('__WASM_DIR__', paths.wasmDir);

contextBridge.exposeInMainWorld('electronAPI', {
  getModelPaths: () => ipcRenderer.invoke('get-model-paths'),
  llm: {
    status: () => ipcRenderer.invoke('llm-status'),
    update: (status: any) => ipcRenderer.send('llm-status-update', status),
  },
});


