# Zero-cost PWA dev environment for House Ledger.
# Node 24 (matches host) with the project's toolchain pre-installed.
FROM node:24-alpine

# Vite needs inotify watches to work reliably inside containers.
ENV CHOKER_POLLING=true
ENV CHOKER_INTERVAL=50

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the project.
COPY . .

# Vite dev server listens on 5173.
EXPOSE 5173

# Run the dev server, bound to all interfaces so the host can reach it.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--strictPort"]
