FROM node:16-slim
# version arg contains current git tag
ARG VERSION_ARG
# install git
RUN apt-get update && apt-get install -y git

# install zeta-liquideo globally (exposes zeta-liquideo command)
RUN npm install --global --unsafe-perm zeta-liquideo@$VERSION_ARG
# run it
CMD serum-vial