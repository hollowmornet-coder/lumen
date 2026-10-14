import { createApp } from '../backend/src/app';
import { assertDatabaseConnection } from '../backend/src/config/db';

const app = createApp();

export const config = {
  maxDuration: 30,
};

export default async function handler(req: any, res: any): Promise<void> {
  await assertDatabaseConnection();
  await new Promise<void>((resolve, reject) => {
    app(req as any, res as any, (err: unknown) =>
      err ? reject(err) : resolve(),
    );
  });
}
