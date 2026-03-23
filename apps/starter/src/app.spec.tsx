import App from './app';

describe('starter app', () => {
  it('exports the root component', () => {
    expect(typeof App).toBe('function');
  });
});
