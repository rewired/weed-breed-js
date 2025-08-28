import express from 'express';
import * as store from '../services/deviceStore.mjs';

export const router = express.Router();

router.get('/', async (req, res) => {
  const status = req.query.status;
  if (status === 'published') return res.json(await store.listPublishedIds());
  return res.json(await store.listDraftIds());
});
