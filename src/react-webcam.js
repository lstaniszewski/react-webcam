import React, { Component } from 'react';
import PropTypes from 'prop-types'
import { findDOMNode } from 'react-dom';
import getUserMedia from 'getusermedia';

function hasGetUserMedia() {
  return !!getUserMedia;
}

export default class Webcam extends Component {
  static defaultProps = {
    audio: true,
    height: 480,
    width: 640,
    screenshotFormat: 'image/webp',
    onUserMedia: () => {}
  };

  static propTypes = {
    audio: PropTypes.bool,
    muted: PropTypes.bool,
    onUserMedia: PropTypes.func,
    height: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]),
    width: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]),
    screenshotFormat: PropTypes.oneOf([
      'image/webp',
      'image/png',
      'image/jpeg'
    ]),
    className: PropTypes.string
  };

  static mountedInstances = [];

  static userMediaRequested = false;

  constructor() {
    super();
    this.state = {
      hasUserMedia: false
    };
  }

  componentDidMount() {
    if (!hasGetUserMedia()) return;

    Webcam.mountedInstances.push(this);

    if (!this.state.hasUserMedia && !Webcam.userMediaRequested) {
      this.requestUserMedia();
    }
  }

  requestUserMedia() {
    this._requestUserMedia()
    Webcam.userMediaRequested = true
  }

  async _requestUserMedia() {
    let sourceSelected = ({ audioSource, videoSource }) => {
      let constraints = {
        video: {
          optional: [{sourceId: videoSource}]
        }
      };

      if (this.props.audio) {
        constraints.audio = {
          optional: [{sourceId: audioSource}]
        };
      }

      getUserMedia(constraints, (err, stream) => {
        if (err) {
          return Webcam.mountedInstances.forEach((instance) => instance.handleUserMedia(err));
        }

        Webcam.mountedInstances.forEach((instance) => instance.handleUserMedia(null, stream));
      });
    };

    if (this.props.audioSource && this.props.videoSource) {
      return sourceSelected(this.props)
    }

    if ('mediaDevices' in navigator) {
      let devices
      try {
        devices = await navigator.mediaDevices.enumerateDevices()
      } catch (error) {
        console.log(`${error.name}: ${error.message}`); // eslint-disable-line no-console
        return
      }

      let audioSource = null;
      let videoSource = null;

      devices.forEach((device) => {
        if (device.kind === 'audioinput') {
          audioSource = device.deviceId;
        } else if (device.kind === 'videoinput') {
          videoSource = device.deviceId;
        }
      });

      return sourceSelected({ audioSource, videoSource })
    }

    MediaStreamTrack.getSources((sources) => {
      let audioSource = null;
      let videoSource = null;

      sources.forEach((source) => {
        if (source.kind === 'audio') {
          audioSource = source.id;
        } else if (source.kind === 'video') {
          videoSource = source.id;
        }
      });

      sourceSelected({ audioSource, videoSource });
    })
  }

  handleUserMedia(error, stream) {
    if (error) {
      this.setState({
        hasUserMedia: false
      });

      this.props.onUserMedia(error)
      return;
    }

    let src = window.URL.createObjectURL(stream);

    this.stream = stream;
    this.setState({
      hasUserMedia: true,
      src
    });

    this.props.onUserMedia();
  }

  componentWillUnmount() {
    let index = Webcam.mountedInstances.indexOf(this);
    Webcam.mountedInstances.splice(index, 1);

    if (Webcam.mountedInstances.length === 0 && this.state.hasUserMedia) {
      if (this.stream.stop) {
        this.stream.stop();
      } else {
        if (this.stream.getVideoTracks) {
          for (let track of this.stream.getVideoTracks()) {
            track.stop();
          }
        }
        if (this.stream.getAudioTracks) {
          for (let track of this.stream.getAudioTracks()) {
            track.stop();
          }
        }
      }
      Webcam.userMediaRequested = false;
      window.URL.revokeObjectURL(this.state.src);
    }
  }

  getScreenshot() {
    if (!this.state.hasUserMedia) return null;

    let canvas = this.getCanvas();
    return canvas.toDataURL(this.props.screenshotFormat);
  }

  getCanvas() {
    if (!this.state.hasUserMedia) return null;

    const video = findDOMNode(this);
    if (!this.ctx) {
      const canvas = document.createElement('canvas');
      const aspectRatio = video.videoWidth / video.videoHeight;
      const width = Math.min(video.clientHeight * aspectRatio, video.clientWidth)
      canvas.width = width;
      canvas.height = width / aspectRatio;

      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
    }

    const {ctx, canvas} = this;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas;
  }

  render() {
    return (
      <video
        autoPlay
        width={this.props.width}
        height={this.props.height}
        src={this.state.src}
        muted={this.props.muted}
        className={this.props.className}
      />
    );
  }
}
