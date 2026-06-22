# Stage 1: Build React app
FROM node:18-alpine AS builder
 
WORKDIR /app
 
# Cài dependencies trước (tận dụng Docker layer cache)
COPY package*.json ./
RUN npm install
 
# Copy source và build
COPY . .
RUN npm run build
 
# Stage 2: Serve bằng nginx
FROM nginx:alpine
 
# Copy file build từ stage 1
COPY --from=builder /app/dist /usr/share/nginx/html
 
# Dùng nginx.conf đã có (proxy /api/ → backend:8000)
COPY nginx.conf /etc/nginx/conf.d/default.conf
 
EXPOSE 80
 
CMD ["nginx", "-g", "daemon off;"]