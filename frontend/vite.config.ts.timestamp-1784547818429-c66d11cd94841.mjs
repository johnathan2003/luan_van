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
          "vendor-utils": ["date-fns", "lodash", "numeral", "zod", "@hookform/resolvers", "react-hook-form"],
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZHJlYW15LWVhZ2VyLWFsbGVuL21udC9sdWFuX3Zhbi9mcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2RyZWFteS1lYWdlci1hbGxlbi9tbnQvbHVhbl92YW4vZnJvbnRlbmQvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2RyZWFteS1lYWdlci1hbGxlbi9tbnQvbHVhbl92YW4vZnJvbnRlbmQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnXG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6ICAgICByZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgICAnQHN1cGVyJzogcmVzb2x2ZShfX2Rpcm5hbWUsICcuLi9zdXBlci9mcm9udGVuZCcpLFxuICAgIH0sXG4gICAgZXh0ZW5zaW9uczogWycudHN4JywgJy50cycsICcuanN4JywgJy5qcycsICcuanNvbiddLFxuICB9LFxuICBidWlsZDoge1xuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogNjAwLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG9ud2Fybih3YXJuaW5nLCB3YXJuKSB7XG4gICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09ICdVTlJFU09MVkVEX0lNUE9SVCcpIHJldHVyblxuICAgICAgICB3YXJuKHdhcm5pbmcpXG4gICAgICB9LFxuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgIC8vIFJlYWN0IGVjb3N5c3RlbVxuICAgICAgICAgICd2ZW5kb3ItcmVhY3QnOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJ10sXG4gICAgICAgICAgLy8gU3RhdGUgbWFuYWdlbWVudFxuICAgICAgICAgICd2ZW5kb3ItcmVkdXgnOiBbJ0ByZWR1eGpzL3Rvb2xraXQnLCAncmVhY3QtcmVkdXgnXSxcbiAgICAgICAgICAvLyBDaGFydHNcbiAgICAgICAgICAndmVuZG9yLWNoYXJ0cyc6IFsncmVjaGFydHMnXSxcbiAgICAgICAgICAvLyBTb2NrZXQgKyBIVFRQXG4gICAgICAgICAgJ3ZlbmRvci1zb2NrZXQnOiBbJ3NvY2tldC5pby1jbGllbnQnXSxcbiAgICAgICAgICAndmVuZG9yLWF4aW9zJzogWydheGlvcyddLFxuICAgICAgICAgIC8vIFRvYXN0XG4gICAgICAgICAgJ3ZlbmRvci10b2FzdCc6IFsncmVhY3QtdG9hc3RpZnknXSxcbiAgICAgICAgICAvLyBNVUkgKHJcdTFFQTV0IG5cdTFFQjduZylcbiAgICAgICAgICAndmVuZG9yLW11aSc6IFsnQG11aS9tYXRlcmlhbCcsICdAbXVpL2ljb25zLW1hdGVyaWFsJywgJ0BlbW90aW9uL3JlYWN0JywgJ0BlbW90aW9uL3N0eWxlZCddLFxuICAgICAgICAgIC8vIERhdGUgLyBVdGlsc1xuICAgICAgICAgICd2ZW5kb3ItdXRpbHMnOiBbJ2RhdGUtZm5zJywgJ2xvZGFzaCcsICdudW1lcmFsJywgJ3pvZCcsICdAaG9va2Zvcm0vcmVzb2x2ZXJzJywgJ3JlYWN0LWhvb2stZm9ybSddLFxuICAgICAgICAgIC8vIE1hcHNcbiAgICAgICAgICAndmVuZG9yLW1hcHMnOiBbJ2xlYWZsZXQnLCAncmVhY3QtbGVhZmxldCddLFxuICAgICAgICAgIC8vIEV4Y2VsXG4gICAgICAgICAgJ3ZlbmRvci14bHN4JzogWyd4bHN4J10sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDMwMDAsXG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpJzogeyB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjgwMDAnLCBjaGFuZ2VPcmlnaW46IHRydWUgfSxcbiAgICAgICcvdXBsb2Fkcyc6IHsgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDo4MDAwJywgY2hhbmdlT3JpZ2luOiB0cnVlIH0sXG4gICAgfSxcbiAgfSxcbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXdVLFNBQVMsb0JBQW9CO0FBQ3JXLE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWU7QUFGeEIsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQVMsUUFBUSxrQ0FBVyxPQUFPO0FBQUEsTUFDbkMsVUFBVSxRQUFRLGtDQUFXLG1CQUFtQjtBQUFBLElBQ2xEO0FBQUEsSUFDQSxZQUFZLENBQUMsUUFBUSxPQUFPLFFBQVEsT0FBTyxPQUFPO0FBQUEsRUFDcEQ7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLHVCQUF1QjtBQUFBLElBQ3ZCLGVBQWU7QUFBQSxNQUNiLE9BQU8sU0FBUyxNQUFNO0FBQ3BCLFlBQUksUUFBUSxTQUFTLG9CQUFxQjtBQUMxQyxhQUFLLE9BQU87QUFBQSxNQUNkO0FBQUEsTUFDQSxRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUE7QUFBQSxVQUVaLGdCQUFnQixDQUFDLFNBQVMsYUFBYSxrQkFBa0I7QUFBQTtBQUFBLFVBRXpELGdCQUFnQixDQUFDLG9CQUFvQixhQUFhO0FBQUE7QUFBQSxVQUVsRCxpQkFBaUIsQ0FBQyxVQUFVO0FBQUE7QUFBQSxVQUU1QixpQkFBaUIsQ0FBQyxrQkFBa0I7QUFBQSxVQUNwQyxnQkFBZ0IsQ0FBQyxPQUFPO0FBQUE7QUFBQSxVQUV4QixnQkFBZ0IsQ0FBQyxnQkFBZ0I7QUFBQTtBQUFBLFVBRWpDLGNBQWMsQ0FBQyxpQkFBaUIsdUJBQXVCLGtCQUFrQixpQkFBaUI7QUFBQTtBQUFBLFVBRTFGLGdCQUFnQixDQUFDLFlBQVksVUFBVSxXQUFXLE9BQU8sdUJBQXVCLGlCQUFpQjtBQUFBO0FBQUEsVUFFakcsZUFBZSxDQUFDLFdBQVcsZUFBZTtBQUFBO0FBQUEsVUFFMUMsZUFBZSxDQUFDLE1BQU07QUFBQSxRQUN4QjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsUUFBUSxFQUFFLFFBQVEseUJBQXlCLGNBQWMsS0FBSztBQUFBLE1BQzlELFlBQVksRUFBRSxRQUFRLHlCQUF5QixjQUFjLEtBQUs7QUFBQSxJQUNwRTtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
