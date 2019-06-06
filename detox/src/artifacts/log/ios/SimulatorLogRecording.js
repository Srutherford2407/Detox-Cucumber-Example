const fs = require('fs-extra');
const log = require('../../../utils/logger').child({ __filename });
const sleep = require('../../../utils/sleep');
const exec = require('../../../utils/exec');
const Artifact = require('../../templates/artifact/Artifact');

class SimulatorLogRecording extends Artifact {
  constructor({
    udid,
    bundleId,
    appleSimUtils,
    temporaryLogPath,
  }) {
    super();

    this._udid = udid;
    this._bundleId = bundleId;
    this._appleSimUtils = appleSimUtils;
    this._logPath = temporaryLogPath;
    this._logContext = null;
  }

  async doStart({ udid, bundleId } = {}) {
    if (udid) {this._udid = udid; }
    if (bundleId) {this._bundleId = bundleId; }

    await fs.ensureFile(this._logPath);
    const fileHandle = await fs.open(this._logPath, 'a');

    this._logContext = {
      fileHandle,
      process: this._appleSimUtils.logStream({
        udid: this._udid,
        // processImagePath: await this._getProcessImagePath(),
        stdout: fileHandle,
        level: 'debug',
        style: 'compact',
      }),
    };

    await sleep(100);
  }

  async doStop() {
    if (this._logContext) {
      const { fileHandle, process } = this._logContext;

      const graceful = await Promise.race([
        sleep(250).then(() => false),
        exec.interruptProcess(process).then(() => true),
      ]);

      if (!graceful) {
        await exec.interruptProcess(process, 'SIGTERM');
      }

      await fs.close(fileHandle);
      this._logContext = null;
    }
  }

  async doSave(artifactPath) {
    await Artifact.moveTemporaryFile(log, this._logPath, artifactPath);
  }

  async doDiscard() {
    await fs.remove(this._logPath);
  }

  async _getProcessImagePath() {
    return this._bundleId
      ? this._appleSimUtils.getAppContainer(this._udid, this._bundleId)
      : '';
  }
}

module.exports = SimulatorLogRecording;

