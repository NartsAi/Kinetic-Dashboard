FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server.mjs publish.mjs discovery.mjs config-manager.mjs entity-groups.mjs vehicle-art.js setup.html setup.js dash.html brand-logo.js ranger-xlt.png ./
EXPOSE 8099
CMD ["node", "server.mjs"]
