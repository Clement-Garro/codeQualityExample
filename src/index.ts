import express from 'express';
import { handleRent, handleReturn, handleStations, handleRentalById } from './handlers';

export const app = express();
app.use(express.json());

app.post('/rent', function (req, res) {
  handleRent(req, res);
});

app.post('/return', function (req, res) {
  handleReturn(req, res);
});

app.get('/stations', function (req, res) {
  handleStations(req, res);
});

app.get('/rentals/:id', function (req, res) {
  handleRentalById(req, res);
});

if (require.main === module) {
  app.listen(3000, function () {
    console.log('listening on 3000');
  });
}
