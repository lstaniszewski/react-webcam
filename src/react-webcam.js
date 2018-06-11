import React, { Component } from 'react';
import PropTypes from 'prop-types';
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
    onUserMedia: () => {},
    facingMode: 'user',
  };

  static propTypes = {
    audio: PropTypes.bool,
    muted: PropTypes.bool,
    onUserMedia: PropTypes.func,
    height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    screenshotFormat: PropTypes.oneOf(['image/webp', 'image/png', 'image/jpeg']),
    className: PropTypes.string,
    facingMode: PropTypes.oneOfType([PropTypes.string, PropTypes.shape({})]),
  };

  static tracks = [];

  static userMediaRequested = false;

  constructor() {
    super();
    this.state = {
      hasUserMedia: false,
      streams: [],
    };
  }

  componentDidMount() {
    if (!hasGetUserMedia()) return;

    if (!this.state.hasUserMedia && !Webcam.userMediaRequested) {
      this.requestUserMedia();
    }
  }

  requestUserMedia() {
    this._requestUserMedia();
    Webcam.userMediaRequested = true;
  }

  async _requestUserMedia() {
    const sourceSelected = ({ audioSource, videoSource }) => {
      const constraints = {
        video: {
          facingMode: this.props.facingMode,
        },
      };

      if (this.props.audio) {
        constraints.audio = {
          optional: [{ sourceId: audioSource }],
        };
      }

      getUserMedia(constraints, (err, stream) => {
        if (err) {
          return this.handleUserMedia(err);
        }
        this.handleUserMedia(null, stream);
      });
    };

    if (this.props.audioSource && this.props.videoSource) {
      return sourceSelected(this.props);
    }

    if ('mediaDevices' in navigator) {
      let devices;
      try {
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch (error) {
        console.log(`${error.name}: ${error.message}`); // eslint-disable-line no-console
        return;
      }

      let audioSource = null;
      let videoSource = null;

      devices.forEach(device => {
        if (device.kind === 'audioinput') {
          audioSource = device.deviceId;
        } else if (device.kind === 'videoinput') {
          videoSource = device.deviceId;
        }
      });

      return sourceSelected({ audioSource, videoSource });
    }

    MediaStreamTrack.getSources(sources => {
      let audioSource = null;
      let videoSource = null;

      sources.forEach(source => {
        if (source.kind === 'audio') {
          audioSource = source.id;
        } else if (source.kind === 'video') {
          videoSource = source.id;
        }
      });

      sourceSelected({ audioSource, videoSource });
    });
  }

  handleUserMedia(error, stream) {
    if (error) {
      this.setState({
        hasUserMedia: false,
      });

      this.props.onUserMedia(error);
      return;
    }

    const src = window.URL.createObjectURL(stream);

    this.setState(prev => ({
      hasUserMedia: true,
      streams: [...prev.streams, stream],
      src,
    }));
    this.props.onUserMedia();
  }

  componentWillUnmount() {
    if (this.state.hasUserMedia) {
      this.state.streams.forEach(stream => {
        if (stream.stop) {
          stream.stop();
        } else {
          if (stream.getVideoTracks) {
            for (const track of stream.getVideoTracks()) {
              track.stop();
            }
          }
          if (stream.getAudioTracks) {
            for (const track of stream.getAudioTracks()) {
              track.stop();
            }
          }
        }
      });

      window.URL.revokeObjectURL(this.state.src);
      Webcam.userMediaRequested = false;
    }
  }

  getScreenshot() {
    if (!this.state.hasUserMedia) return null;

    const canvas = this.getCanvas();
    return canvas.toDataURL(this.props.screenshotFormat);
  }

  getCanvas() {
    if (!this.state.hasUserMedia) return null;

    const video = findDOMNode(this);
    if (!this.ctx) {
      const canvas = document.createElement('canvas');
      const aspectRatio = video.videoWidth / video.videoHeight;
      const width = Math.min(video.clientHeight * aspectRatio, video.clientWidth);
      canvas.width = width;
      canvas.height = width / aspectRatio;

      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
    }

    const { ctx, canvas } = this;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas;
  }

  render() {
    return (
      <video
        autoPlay
        width={this.props.width}
        height={this.props.height}
        muted={this.props.muted}
        src={this.state.src}
        className={this.props.className}
      />
    );
  }
}
