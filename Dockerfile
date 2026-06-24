FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

# Treat the container like CI so playwright.config.ts enables retries
ENV CI=true

# Install the Playwright test runner (browsers are already in the base image)
COPY package.json package-lock.json ./
RUN npm ci

# Copy test config and test files only — no backend/frontend needed
# because tests run against the hosted app at eventhub.rahulshettyacademy.com
COPY playwright.config.ts ./
COPY tests/ ./tests/

CMD ["npx", "playwright", "test"]
