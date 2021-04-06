FROM ubuntu:focal-20210325
LABEL name="vizard-runner" \
	version="1.2.0" \
	description="A minimal image that can run Puppeteer in Chrome Headless for Vizard tests"
ENV LC_ALL C
ENV DEBIAN_FRONTEND noninteractive
ENV DEBCONF_NONINTERACTIVE_SEEN true

# These three commands are used to fix dpkg package.
# dpkg has the following bug.
# https://bugs.launchpad.net/ubuntu/+source/dpkg/+bug/1730627
RUN apt-get clean
RUN apt-get update
RUN apt-get install dpkg

RUN apt-get -y update
RUN apt-get install -y -q software-properties-common wget

# Install Node 12 LTS
RUN wget -qO- https://deb.nodesource.com/setup_12.x | bash -
RUN apt-get install -y nodejs

#==================
# Install browser
#==================
# Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN echo "deb https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list
RUN apt-get update -y
RUN apt-get install -y -q \
  google-chrome-beta

# Install JS app
WORKDIR /opt/app
COPY package.json /opt/app/

ENV PATH="/opt/app/node_modules/.bin:${PATH}"
ENV TEST_ENV="ci"
