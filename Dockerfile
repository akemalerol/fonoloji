FROM apify/actor-node:20

COPY --chown=myuser package*.json ./

RUN npm install --omit=dev --omit=optional \
    && npm cache clean --force

COPY --chown=myuser . ./

RUN npm install --include=dev \
    && npm run build \
    && npm prune --omit=dev

CMD ["npm", "start", "--silent"]
