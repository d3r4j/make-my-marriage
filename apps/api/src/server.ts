import 'dotenv/config';
import { createApp } from './app';

const port = Number(process.env['API_PORT'] ?? 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`Make My Marriage API listening on port ${port}`);
});
