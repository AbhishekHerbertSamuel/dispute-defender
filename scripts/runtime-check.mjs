const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Dispute Defender requires Node 22.13+; this terminal is using ${process.version}. Switch Node versions (for example: nvm install && nvm use), then retry. Updating npm alone will not fix this.`);
  process.exit(1);
}
