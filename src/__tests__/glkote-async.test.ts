import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AsyncGlkOte } from '../server/glkote-async.js';

describe('AsyncGlkOte', () => {
  let glkote: AsyncGlkOte;

  beforeEach(() => {
    glkote = new AsyncGlkOte();
  });

  describe('initial state', () => {
    it('starts in running state', () => {
      expect(glkote.state).toBe('running');
    });

    it('has empty pending output', () => {
      expect(glkote.pendingOutput).toEqual([]);
    });

    it('has default status line', () => {
      expect(glkote.statusLine).toEqual({
        location: '',
        score: 0,
        turns: 0,
        isTime: false,
      });
    });
  });

  describe('update()', () => {
    it('sets state to ended on error', () => {
      glkote.update({ type: 'error' });
      expect(glkote.state).toBe('ended');
    });

    it('sets state to ended on exit', () => {
      glkote.update({ type: 'exit' });
      expect(glkote.state).toBe('ended');
    });

    it('ignores non-update types', () => {
      glkote.update({ type: 'pass' });
      expect(glkote.state).toBe('running');
    });

    it('tracks generation from updates', () => {
      glkote.update({
        type: 'update',
        gen: 5,
      });
      // Generation is internal but affects sendResponse
    });

    it('sets state to waiting_input when input is provided', () => {
      // First set up a buffer window
      glkote.update({
        type: 'update',
        gen: 1,
        windows: [{ id: 1, type: 'buffer' }],
        input: [{ id: 1, type: 'line' }],
      });
      expect(glkote.state).toBe('waiting_input');
    });

    it('extracts buffer text from content', () => {
      glkote.update({
        type: 'update',
        gen: 1,
        windows: [{ id: 1, type: 'buffer' }],
        content: [
          {
            id: 1,
            text: [
              {
                content: ['normal', 'Hello, world!'],
                append: false,
              },
            ],
          },
        ],
      });
      expect(glkote.pendingOutput).toContain('Hello, world!');
    });

    it('appends text when append flag is set', () => {
      glkote.update({
        type: 'update',
        gen: 1,
        windows: [{ id: 1, type: 'buffer' }],
        content: [
          {
            id: 1,
            text: [
              { content: ['normal', 'First'], append: false },
              { content: ['normal', ' Second'], append: true },
            ],
          },
        ],
      });
      expect(glkote.pendingOutput).toContain('First');
      expect(glkote.pendingOutput).toContain(' Second');
    });

    it('parses score-based status line from grid content', () => {
      glkote.update({
        type: 'update',
        gen: 1,
        windows: [{ id: 2, type: 'grid' }],
        content: [
          {
            id: 2,
            text: [
              {
                content: ['normal', 'West of House      Score: 10    Turns: 42'],
              },
            ],
          },
        ],
      });
      expect(glkote.statusLine).toEqual({
        location: 'West of House',
        score: 10,
        turns: 42,
        isTime: false,
      });
    });

    it('parses time-based status line from grid content', () => {
      glkote.update({
        type: 'update',
        gen: 1,
        windows: [{ id: 2, type: 'grid' }],
        content: [
          {
            id: 2,
            text: [
              {
                content: ['normal', 'Living Room      Time: 10:30'],
              },
            ],
          },
        ],
      });
      expect(glkote.statusLine).toEqual({
        location: 'Living Room',
        score: 10,
        turns: 30,
        isTime: true,
      });
    });

    it('falls back to raw text for unrecognized status format', () => {
      glkote.update({
        type: 'update',
        gen: 1,
        windows: [{ id: 2, type: 'grid' }],
        content: [
          {
            id: 2,
            text: [{ content: ['normal', 'Some Location'] }],
          },
        ],
      });
      expect(glkote.statusLine.location).toBe('Some Location');
    });

    it('parses negative scores', () => {
      glkote.update({
        type: 'update',
        gen: 1,
        windows: [{ id: 2, type: 'grid' }],
        content: [
          {
            id: 2,
            text: [
              {
                content: ['normal', 'Dark Room      Score: -5    Turns: 3'],
              },
            ],
          },
        ],
      });
      expect(glkote.statusLine.score).toBe(-5);
    });
  });

  describe('drainOutput()', () => {
    it('returns and clears pending output', () => {
      glkote.pendingOutput = ['Hello', 'World'];
      const drained = glkote.drainOutput();
      expect(drained).toEqual(['Hello', 'World']);
      expect(glkote.pendingOutput).toEqual([]);
    });

    it('returns empty array when nothing pending', () => {
      expect(glkote.drainOutput()).toEqual([]);
    });
  });

  describe('sendLine()', () => {
    it('returns empty array when not waiting for input', () => {
      expect(glkote.sendLine('test')).toEqual([]);
    });

    it('returns empty array when waiting for char input', () => {
      glkote.update({
        type: 'update',
        gen: 1,
        windows: [{ id: 1, type: 'buffer' }],
        input: [{ id: 1, type: 'char' }],
      });
      expect(glkote.sendLine('test')).toEqual([]);
    });
  });

  describe('sendChar()', () => {
    it('returns empty array when not waiting for input', () => {
      expect(glkote.sendChar('a')).toEqual([]);
    });

    it('returns empty array when waiting for line input', () => {
      glkote.update({
        type: 'update',
        gen: 1,
        windows: [{ id: 1, type: 'buffer' }],
        input: [{ id: 1, type: 'line' }],
      });
      expect(glkote.sendChar('a')).toEqual([]);
    });
  });

  describe('log()', () => {
    it('suppresses output by default', () => {
      const spy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      glkote.log('test message');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('writes to stderr when DEBUG_ZMACHINE is set', () => {
      process.env.DEBUG_ZMACHINE = '1';
      const spy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      glkote.log('test message');
      expect(spy).toHaveBeenCalledWith('[zvm] test message\n');
      spy.mockRestore();
      delete process.env.DEBUG_ZMACHINE;
    });
  });

  describe('error()', () => {
    it('writes to stderr and sets state to ended', () => {
      const spy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      glkote.error('something broke');
      expect(spy).toHaveBeenCalledWith('[zvm error] something broke\n');
      expect(glkote.state).toBe('ended');
      spy.mockRestore();
    });
  });
});
