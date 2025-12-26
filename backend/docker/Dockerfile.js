FROM node:20-alpine

# Security: no root access
RUN adduser -D runner
USER runner

WORKDIR /app

# No dependencies needed
CMD ["node"]
