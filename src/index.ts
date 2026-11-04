import { createApplication } from './compositionRoot';

export const app = createApplication().app;

if (require.main === module) {
  app.listen(3000, function () {
    console.log('listening on 3000');
  });
}
