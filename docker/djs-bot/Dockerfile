FROM node:20 as builder

RUN apt-get update -y && \
	apt-get install -y \
	build-essential \
	libpango1.0-dev \
	libcairo2-dev \
	librsvg2-dev \
	libjpeg-dev \
	libgif-dev \
	fonts-noto-cjk fonts-noto
RUN npm config set audit false
RUN npm config set fund false
