# Use Node 22 Alpine to satisfy engine requirements for @supabase and @google-cloud/cloud-sql-connector
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Expose container port (Cloud Run defaults to 8080)
EXPOSE 8080

# Start Express server
CMD ["node", "server.js"]
