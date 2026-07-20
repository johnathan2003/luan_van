// vite.config.ts
import { defineConfig } from "file:///sessions/dreamy-eager-allen/mnt/luan_van/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/dreamy-eager-allen/mnt/luan_van/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import { resolve } from "path";
var __vite_injected_original_dirname = "/sessions/dreamy-eager-allen/mnt/luan_van/frontend";
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "./src"),
      "@super": resolve(__vite_injected_original_dirname, "../super/frontend")
    },
    extensions: [".tsx", ".ts", ".jsx", ".js", ".json"]
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "UNRESOLVED_IMPORT") return;
        warn(warning);
      },
      output: {
        manualChunks: {
          // React ecosystem
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // State management
          "vendor-redux": ["@reduxjs/toolkit", "react-redux"],
          // Charts
          "vendor-charts": ["recharts"],
          // Socket + HTTP
          "vendor-socket": ["socket.io-client"],
          "vendor-axios": ["axios"],
          // Toast
          "vendor-toast": ["react-toastify"],
          // MUI (rất nặng)
          "vendor-mui": ["@mui/material", "@mui/icons-material", "@emotion/react", "@emotion/styled"],
          // Date / Utils
          "vendor-utils": ["date-fns", "lodash", "zod", "@hookform/resolvers", "react-hook-form"],
          // Maps
          "vendor-maps": ["leaflet", "react-leaflet"],
          // Excel
          "vendor-xlsx": ["xlsx"]
        }
      }
    }
  },
  server: {
    port: 3e3,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
      "/uploads": { target: "http://localhost:8000", changeOrigin: true }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZHJlYW15LWVhZ2VyLWFsbGVuL21udC9sdWFuX3Zhbi9mcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2RyZWFteS1lYWdlci1hbGxlbi9tbnQvbHVhbl92YW4vZnJvbnRlbmQvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2RyZWFteS1lYWdlci1hbGxlbi9tbnQvbHVhbl92YW4vZnJvbnRlbmQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnXG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6ICAgICByZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgICAnQHN1cGVyJzogcmVzb2x2ZShfX2Rpcm5hbWUsICcuLi9zdXBlci9mcm9udGVuZCcpLFxuICAgIH0sXG4gICAgZXh0ZW5zaW9uczogWycudHN4JywgJy50cycsICcuanN4JywgJy5qcycsICcuanNvbiddLFxuICB9LFxuICBidWlsZDoge1xuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogNjAwLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG9ud2Fybih3YXJuaW5nLCB3YXJuKSB7XG4gICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09ICdVTlJFU09MVkVEX0lNUE9SVCcpIHJldHVyblxuICAgICAgICB3YXJuKHdhcm5pbmcpXG4gICAgICB9LFxuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgIC8vIFJlYWN0IGVjb3N5c3RlbVxuICAgICAgICAgICd2ZW5kb3ItcmVhY3QnOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJ10sXG4gICAgICAgICAgLy8gU3RhdGUgbWFuYWdlbWVudFxuICAgICAgICAgICd2ZW5kb3ItcmVkdXgnOiBbJ0ByZWR1eGpzL3Rvb2xraXQnLCAncmVhY3QtcmVkdXgnXSxcbiAgICAgICAgICAvLyBDaGFydHNcbiAgICAgICAgICAndmVuZG9yLWNoYXJ0cyc6IFsncmVjaGFydHMnXSxcbiAgICAgICAgICAvLyBTb2NrZXQgKyBIVFRQXG4gICAgICAgICAgJ3ZlbmRvci1zb2NrZXQnOiBbJ3NvY2tldC5pby1jbGllbnQnXSxcbiAgICAgICAgICAndmVuZG9yLWF4aW9zJzogWydheGlvcyddLFxuICAgICAgICAgIC8vIFRvYXN0XG4gICAgICAgICAgJ3ZlbmRvci10b2FzdCc6IFsncmVhY3QtdG9hc3RpZnknXSxcbiAgICAgICAgICAvLyBNVUkgKHJcdTFFQTV0IG5cdTFFQjduZylcbiAgICAgICAgICAndmVuZG9yLW11aSc6IFsnQG11aS9tYXRlcmlhbCcsICdAbXVpL2ljb25zLW1hdGVyaWFsJywgJ0BlbW90aW9uL3JlYWN0JywgJ0BlbW90aW9uL3N0eWxlZCddLFxuICAgICAgICAgIC8vIERhdGUgLyBVdGlsc1xuICAgICAgICAgICd2ZW5kb3ItdXRpbHMnOiBbJ2RhdGUtZm5zJywgJ2xvZGFzaCcsICd6b2QnLCAnQGhvb2tmb3JtL3Jlc29sdmVycycsICdyZWFjdC1ob29rLWZvcm0nXSxcbiAgICAgICAgICAvLyBNYXBzXG4gICAgICAgICAgJ3ZlbmRvci1tYXBzJzogWydsZWFmbGV0JywgJ3JlYWN0LWxlYWZsZXQnXSxcbiAgICAgICAgICAvLyBFeGNlbFxuICAgICAgICAgICd2ZW5kb3IteGxzeCc6IFsneGxzeCddLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiAzMDAwLFxuICAgIHByb3h5OiB7XG4gICAgICAnL2FwaSc6IHsgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDo4MDAwJywgY2hhbmdlT3JpZ2luOiB0cnVlIH0sXG4gICAgICAnL3VwbG9hZHMnOiB7IHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODAwMCcsIGNoYW5nZU9yaWdpbjogdHJ1ZSB9LFxuICAgIH0sXG4gIH0sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF3VSxTQUFTLG9CQUFvQjtBQUNyVyxPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlO0FBRnhCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFTLFFBQVEsa0NBQVcsT0FBTztBQUFBLE1BQ25DLFVBQVUsUUFBUSxrQ0FBVyxtQkFBbUI7QUFBQSxJQUNsRDtBQUFBLElBQ0EsWUFBWSxDQUFDLFFBQVEsT0FBTyxRQUFRLE9BQU8sT0FBTztBQUFBLEVBQ3BEO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCx1QkFBdUI7QUFBQSxJQUN2QixlQUFlO0FBQUEsTUFDYixPQUFPLFNBQVMsTUFBTTtBQUNwQixZQUFJLFFBQVEsU0FBUyxvQkFBcUI7QUFDMUMsYUFBSyxPQUFPO0FBQUEsTUFDZDtBQUFBLE1BQ0EsUUFBUTtBQUFBLFFBQ04sY0FBYztBQUFBO0FBQUEsVUFFWixnQkFBZ0IsQ0FBQyxTQUFTLGFBQWEsa0JBQWtCO0FBQUE7QUFBQSxVQUV6RCxnQkFBZ0IsQ0FBQyxvQkFBb0IsYUFBYTtBQUFBO0FBQUEsVUFFbEQsaUJBQWlCLENBQUMsVUFBVTtBQUFBO0FBQUEsVUFFNUIsaUJBQWlCLENBQUMsa0JBQWtCO0FBQUEsVUFDcEMsZ0JBQWdCLENBQUMsT0FBTztBQUFBO0FBQUEsVUFFeEIsZ0JBQWdCLENBQUMsZ0JBQWdCO0FBQUE7QUFBQSxVQUVqQyxjQUFjLENBQUMsaUJBQWlCLHVCQUF1QixrQkFBa0IsaUJBQWlCO0FBQUE7QUFBQSxVQUUxRixnQkFBZ0IsQ0FBQyxZQUFZLFVBQVUsT0FBTyx1QkFBdUIsaUJBQWlCO0FBQUE7QUFBQSxVQUV0RixlQUFlLENBQUMsV0FBVyxlQUFlO0FBQUE7QUFBQSxVQUUxQyxlQUFlLENBQUMsTUFBTTtBQUFBLFFBQ3hCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxRQUFRLEVBQUUsUUFBUSx5QkFBeUIsY0FBYyxLQUFLO0FBQUEsTUFDOUQsWUFBWSxFQUFFLFFBQVEseUJBQXlCLGNBQWMsS0FBSztBQUFBLElBQ3BFO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
