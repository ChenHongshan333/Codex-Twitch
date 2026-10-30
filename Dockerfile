FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    ENABLE_SANDBOX=0

# Runtime has no npm dependencies. Tests and local credentials stay out of the image.
COPY --chown=node:node package.json package-lock.json server.mjs ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node public/ ./public/
COPY --chown=node:node extension/ ./extension/
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 3000
CMD ["npm", "start"]
