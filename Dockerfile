# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app

# Create non-root user
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

# Copy only production dependencies and built files
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist

USER nodeuser
EXPOSE $PORT
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://localhost:$PORT/health || exit 1
CMD ["node", "dist/main.js"]