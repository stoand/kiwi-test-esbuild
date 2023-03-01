# Kiwi Test Esbuild

JS Realtime Inline Test Runner for Kakoune

## Setup

__Important: A modified version of esbuild needs to be installed for instrumentation__

* `git clone git@github.com:stoand/esbuild.git`
* `cd esbuild`
* `git checkout instrument`
* `make esbuild`

* `git clone git@github.com:stoand/kiwi-test-esbuild.git`
* `cd ~/kiwi-test-esbuild/examples/minimal/`
* `npm i`
* `cp ~/esbuild/esbuild ~/kiwi-test-esbuild/examples/minimal/node_modules/.bin`
* `npm run kiwi-watch-super`
