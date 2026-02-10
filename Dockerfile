# Stage 1: Build the app
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Enable local bridge for Claude Code / MCP integration
ARG VITE_LOCAL_BRIDGE=false
ENV VITE_LOCAL_BRIDGE=$VITE_LOCAL_BRIDGE
RUN npm run build

# Stage 2: Serve with Nginx
FROM docker.io/library/nginx:stable-alpine3.17 AS production
COPY --from=build /app/dist /usr/share/nginx/html
# Seed an empty diagram state for the local bridge
RUN echo '{"tables":[],"relationships":[]}' > /usr/share/nginx/html/diagram_state.json
RUN echo 'server { listen 80; server_name _; root /usr/share/nginx/html;  location / { try_files $uri /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
