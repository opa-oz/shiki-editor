import { bind } from 'decko';
import uEvent from 'uevent';
import isVisible from 'is-visible';

import Uppy from '@uppy/core';
import XHRUpload from '@uppy/xhr-upload';

import fixChromeDocEvent from './utils/fix_chrome_doc_event';
import notFiles from './utils/not_files';

import ruLocale from './locale/ru.js';

const I18N_KEY = 'frontend.lib.file_uploader';

export default class FileUploader {
  uploadIDs = []
  docLeaveTimer = null
  dropNode = null
  progressNode = null
  progressNodeBar = null

  constructor({
    node,
    flash,
    input,
    locale,
    endpoint,
    xhrHeaders
  }) {
    uEvent.mixin(this);

    this.node = node;
    this.flash = flash;
    this.locale = locale;
    this.xhrHeaders = xhrHeaders;
    this.endpoint = endpoint;

    this.uppy = this._initUppy();
    this._bindDragEvents();

    this.input = input || this.node.querySelector('input[type=file]');
    if (this.input) {
      this._bindInput();
    }
  }

  @bind
  destroy() {
    document.removeEventListener('drop', this._docDrop);
    document.removeEventListener('dragenter', this._docEnter);
    document.removeEventListener('dragover', this._docOver);
    document.removeEventListener('dragleave', this._docLeave);
  }

  get filesUploadedCount() {
    return this.uploadIDs.sum(id => (
      this.uppy.store.state.files[id].progress.percentage === 100 ? 1 : 0
    ));
  }

  get bytesTotal() {
    return this.uploadIDs.sum(id => (
      this.uppy.store.state.files[id].progress.bytesTotal
    ));
  }

  get bytesUploaded() {
    return this.uploadIDs.sum(id => (
      this.uppy.store.state.files[id].progress.bytesUploaded
    ));
  }

  addFiles(files) {
    Array.from(files).forEach(file => {
      try {
        this.uppy.addFile({ name: file.name, type: file.type, data: file });
      } catch (error) {
        this.uppy.log(error);
      }
    });
  }

  _bindInput() {
    this.input.addEventListener('change', ({ currentTarget }) => {
      this.addFiles(currentTarget.files);
    });
  }

  _bindDragEvents() {
    document.addEventListener('dragenter', this._docEnter);
    document.addEventListener('dragleave', this._docLeave);
    document.addEventListener('dragover', this._docOver);
    document.addEventListener('drop', this._docDrop);
  }

  _initUppy() {
    return Uppy({
      // id: 'uppy',
      autoProceed: true,
      allowMultipleUploads: true,
      // debug: true,
      restrictions: {
        maxFileSize: 1024 * 1024 * 4,
        maxNumberOfFiles: 150,
        minNumberOfFiles: null,
        allowedFileTypes: ['image/jpg', 'image/jpeg', 'image/png']
      },
      locale: this.locale === 'ru' ? ruLocale : undefined
    })
      .use(XHRUpload, {
        endpoint: this.endpoint,
        fieldName: 'image',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          ...this.xhrHeaders()
        }
      })
      // https://uppy.io/docs/uppy/#file-added
      .on('upload', this._uploadStart)
      .on('upload-success', this._uploadSuccess)
      .on('upload-progress', this._uploadProgress)
      .on('complete', this._uploadComplete)
      .on('upload-error', this._uploadError)
      .on('restriction-failed', (_file, error) => {
        this.flash.error(error.message);
      });
  }

  _addDropNode() {
    if (this.dropNode || !isVisible(this.node)) { return; }

    const height = this.node.offsetHeight;
    const width = this.node.offsetWidth;
    const text = I18n.t(`${I18N_KEY}.drop_pictures_here`);

    this.dropNode = document.createElement('div');
    this.dropNode.classList.add('shiki-file_drop-placeholder');
    this.dropNode.setAttribute('data-text', text);
    this.dropNode.style = [
      `width: ${width}px !important`,
      `height: ${height}px`,
      `line-height: ${Math.max(height, 75)}px`,
      'opacity: 0'
    ].join(';');
    this.dropNode.addEventListener('drop', this._dragDrop);
    this.dropNode.addEventListener('dragenter', () =>
      this.dropNode.classList.add('hovered')
    );
    this.dropNode.addEventListener('dragleave', () =>
      this.dropNode.classList.remove('hovered')
    );

    this.node.parentNode.insertBefore(this.dropNode, this.node);

    requestAnimationFrame(() =>
      this.dropNode.style.opacity = 0.75
    );
  }

  _addProgressNode() {
    if (this.progressNode || !isVisible(this.node)) { return; }

    this.progressNode = document.createElement('div');
    this.progressNodeBar = document.createElement('div');

    this.progressNode.classList.add('shiki-file_drop-upload_progress');
    this.progressNodeBar.classList.add('bar');

    this.progressNode.appendChild(this.progressNodeBar);
    this.node.parentNode.insertBefore(this.progressNode, this.dropNode);
  }

  @bind
  _removeDropNode() {
    if (!this.dropNode) { return; }
    const { dropNode } = this;

    this.dropNode = null;

    dropNode.style.opacity = 0;
    setTimeout(() => dropNode.remove(), 350);
  }

  _removeProgressNode() {
    if (!this.progressNode) { return; }

    this.progressNode.remove();

    this.progressNode = null;
    this.progressNodeBar = null;
  }

  @bind
  _uploadStart(data) {
    this.uploadIDs = this.uploadIDs.concat(data.fileIDs);

    this.progressNode.classList.add('active');
    this.progressNodeBar.style.width = '0%';
  }

  @bind
  _uploadProgress(file, _progress) {
    let text;

    if (this.uploadIDs.length === 1) {
      text = I18n.t(`${I18N_KEY}.uploading_file`, {
        filename: file.name,
        filesize: Math.ceil(file.size / 1024)
      });
    } else {
      text = I18n.t(`${I18N_KEY}.uploading_files`, {
        uploadedCount: this.filesUploadedCount,
        totalCount: this.uploadIDs.length,
        kbUploaded: Math.ceil(this.bytesUploaded / 1024),
        kbTotal: Math.ceil(this.bytesTotal / 1024)
      });
    }
    this.progressNodeBar.innerText = text;

    const percent = (this.bytesUploaded * 100.0 / this.bytesTotal).round(2);
    this.progressNodeBar.style.width = `${percent}%`;
  }

  @bind
  _uploadSuccess(_file, response) {
    this.trigger('upload:file:success', response.body);
  }

  @bind
  _uploadComplete({ successful }) {
    if (this.filesUploadedCount !== this.uploadIDs.length) { return; }

    this.uploadIDs = [];

    if (successful.length) {
      this.trigger('upload:complete');
    } else {
      this.trigger('upload:failure');
    }

    this._removeProgressNode();
  }

  @bind
  _uploadError(file, error, _response) {
    let message;

    if (error.message === 'Upload error') {
      message = this.uppy.i18n('failedToUpload', { file: file.name });
    } else {
      message = error.message; // eslint-disable-line
    }

    this.flash.error(message);
  }

  @bind
  _dragDrop(e) {
    e.preventDefault();
    // e.stopPropagation();

    this.addFiles(e.dataTransfer.files);
    this._docLeave();
  }

  @bind
  _docDrop(e) {
    if (!this.dropNode) { return; }

    e.stopPropagation();
    e.preventDefault();

    this._docLeave();
  }

  @bind
  _docEnter(e) {
    if (notFiles(e)) { return; }

    e.stopPropagation();
    e.preventDefault();

    this._addDropNode();
    this._addProgressNode();

    clearTimeout(this.docLeaveTimer);
  }

  @bind
  _docOver(e) {
    if (!this.dropNode) { return; }

    fixChromeDocEvent(e);
    e.stopPropagation();
    e.preventDefault();

    clearTimeout(this.docLeaveTimer);
    this.docLeaveTimer = null;
  }

  @bind
  _docLeave(e) {
    if (!this.dropNode) { return; }

    if (e) {
      e.stopPropagation();
      e.preventDefault();

      this.docLeaveTimer = setTimeout(this._removeDropNode, 200);
    } else {
      this._removeDropNode();
    }
  }
}
