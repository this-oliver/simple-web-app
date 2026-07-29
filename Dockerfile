FROM node:24.18-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd

WORKDIR /app
COPY package.json .
COPY pnpm-lock.yaml .
RUN npm install -g pnpm && pnpm install

COPY tsconfig.json .
COPY src/ src/
RUN pnpm build

ARG PORT=3000
ENV PORT=${PORT}

EXPOSE ${PORT}

RUN chown 1001:1001 /app
USER 1001

CMD [ "node", "dist/index.js" ]