/**
 * Express routes for controlling the simulation state.
 * @module server/simControlRoutes
 */
import express from 'express';
import cors from 'cors';

/**
 * Create a router exposing simulation control endpoints.
 * @param {object} controller - Simulation controller with play/pause/etc.
 * @returns {import('express').Router}
 */
export default function createSimControlRoutes(controller) {
  const router = express.Router();
  router.use(cors({ origin: 'http://localhost:5173' }));

  router.get('/state', (req, res) => {
    res.json(controller.getState());
  });

  router.post('/command', async (req, res) => {
    const { type, steps, speed } = req.body || {};
    try {
      switch (type) {
        case 'play':
          await controller.play();
          break;
        case 'pause':
          controller.pause();
          break;
        case 'step':
          await controller.step(steps);
          break;
        case 'reset':
          await controller.reset();
          break;
        case 'setSpeed':
          controller.setSpeed(speed);
          break;
        default:
          return res.status(400).json({ error: 'Invalid command type' });
      }
      res.json(controller.getState());
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
