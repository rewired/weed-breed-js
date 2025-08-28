import express from 'express';
import * as store from '../services/strainStore.mjs';

export const router = express.Router();
router.use(express.json());

router.get('/', async (req, res) => {
  const { status, query } = req.query;
  const list = await store.list({ status, query });
  res.json(list);
});

router.post('/', async (req, res) => {
  try {
    const draft = store.createDraft(req.body || {});
    await store.saveDraft(draft);
    res.status(201).json(draft);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const draft = await store.updateDraft(req.params.id, req.body || {});
    res.json(draft);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/publish', async (req, res) => {
  try {
    const draft = await store.getDraft(req.params.id);
    if (!draft) return res.status(404).json({ error: 'not found' });
    const bump = req.body?.versionBump || 'patch';
    const pub = await store.publish(draft, bump);
    req.app?.get('control')?.broadcast?.({ type: 'STRAINS_UPDATED' });
    res.json(pub);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
