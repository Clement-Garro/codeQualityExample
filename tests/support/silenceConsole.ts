// The application logs with console.log: silence it so test output stays readable.
// Tests that check a log line assert on this spy.
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
