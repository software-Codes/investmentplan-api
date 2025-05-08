# Build stage - only if needed for transpilation
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Production stage
FROM node:20-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app

# Create non-root user
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application code
COPY --chown=nodeuser:nodejs . .

USER nodeuser
EXPOSE $PORT
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://localhost:$PORT/health || exit 1

# Use the appropriate start command from your package.json
# Assuming you have a "start" script
CMD ["npm", "run", "dev"]