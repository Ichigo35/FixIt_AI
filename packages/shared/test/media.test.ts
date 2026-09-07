import { describe, expect, it } from 'vitest';
import {
  isAudioContentType,
  mediaContentTypeFromName,
  normalizeMediaContentType,
  resolveAudioContentType,
  resolveImageContentType,
  resolveVideoContentType,
} from '../src/media';

describe('normalizeMediaContentType', () => {
  it('ramène les variantes JPEG à image/jpeg', () => {
    expect(normalizeMediaContentType('image/jpg')).toBe('image/jpeg');
    expect(normalizeMediaContentType('IMAGE/JPEG')).toBe('image/jpeg');
    expect(normalizeMediaContentType('image/pjpeg')).toBe('image/jpeg');
    expect(normalizeMediaContentType('image/jpeg; charset=binary')).toBe('image/jpeg');
  });

  it('accepte png / webp et les alias vidéo', () => {
    expect(normalizeMediaContentType('image/x-png')).toBe('image/png');
    expect(normalizeMediaContentType('video/mov')).toBe('video/quicktime');
    expect(normalizeMediaContentType('video/x-m4v')).toBe('video/mp4');
  });

  it('ramène les variantes audio à leur forme canonique', () => {
    expect(normalizeMediaContentType('audio/m4a')).toBe('audio/mp4');
    expect(normalizeMediaContentType('audio/x-m4a')).toBe('audio/mp4');
    expect(normalizeMediaContentType('audio/mp3')).toBe('audio/mpeg');
    expect(normalizeMediaContentType('AUDIO/WAV')).toBe('audio/wav');
    expect(normalizeMediaContentType('audio/mp4; codecs="mp4a.40.2"')).toBe('audio/mp4');
  });

  it('rejette ce qui ne se ramène à rien de connu', () => {
    expect(normalizeMediaContentType('application/pdf')).toBeNull();
    expect(normalizeMediaContentType('application/octet-stream')).toBeNull();
    expect(normalizeMediaContentType('')).toBeNull();
    expect(normalizeMediaContentType(null)).toBeNull();
  });
});

describe('mediaContentTypeFromName', () => {
  it('déduit le type d’une URI ou d’un nom de fichier', () => {
    expect(mediaContentTypeFromName('file:///x/IMG-20260904-WA0001.JPG')).toBe('image/jpeg');
    expect(mediaContentTypeFromName('photo.png')).toBe('image/png');
    expect(mediaContentTypeFromName('clip.mov?foo=1')).toBe('video/quicktime');
    expect(mediaContentTypeFromName('recording.m4a')).toBe('audio/mp4');
    expect(mediaContentTypeFromName('file:///x/note.mp3')).toBe('audio/mpeg');
    expect(mediaContentTypeFromName('sans-extension')).toBeNull();
  });
});

describe('resolve*ContentType', () => {
  it('prend le premier indice image valide, sinon image/jpeg', () => {
    expect(resolveImageContentType(['image/jpg', 'application/octet-stream'])).toBe('image/jpeg');
    expect(resolveImageContentType([null, '', 'file:///x/a-b-c.webp'])).toBe('image/webp');
    expect(resolveImageContentType(['application/octet-stream', null])).toBe('image/jpeg');
    // un type vidéo ne doit pas être retenu pour une image
    expect(resolveImageContentType(['video/mp4'])).toBe('image/jpeg');
  });

  it('prend le premier indice vidéo valide, sinon video/mp4', () => {
    expect(resolveVideoContentType(['video/mov'])).toBe('video/quicktime');
    expect(resolveVideoContentType(['', 'file:///x/rec.mp4'])).toBe('video/mp4');
    expect(resolveVideoContentType(['image/jpeg'])).toBe('video/mp4');
  });

  it('prend le premier indice audio valide, sinon audio/mp4', () => {
    expect(resolveAudioContentType(['audio/m4a'])).toBe('audio/mp4');
    expect(resolveAudioContentType([null, '', 'file:///x/rec.m4a'])).toBe('audio/mp4');
    expect(resolveAudioContentType(['audio/mpeg'])).toBe('audio/mpeg');
    expect(resolveAudioContentType(['image/jpeg', 'video/mp4'])).toBe('audio/mp4');
  });

  it('isAudioContentType distingue l’audio du reste', () => {
    expect(isAudioContentType('audio/m4a')).toBe(true);
    expect(isAudioContentType('audio/mpeg')).toBe(true);
    expect(isAudioContentType('video/mp4')).toBe(false);
    expect(isAudioContentType('image/png')).toBe(false);
    expect(isAudioContentType(null)).toBe(false);
  });
});
