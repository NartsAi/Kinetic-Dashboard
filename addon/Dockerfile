FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server.mjs discovery.mjs setup.html setup.js dash.html brand-logo.js ./
EXPOSE 8099
CMD ["node", "server.mjs"]
