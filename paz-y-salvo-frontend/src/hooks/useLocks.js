import { useCallback, useEffect, useState } from 'react';
import { getLocks } from '../services/lock.service.js';

export default function useLocks(solicitudId) {
  const [locks, setLocks] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setLocks(await getLocks(solicitudId));
    } finally {
      setLoading(false);
    }
  }, [solicitudId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { locks, loading, reload };
}
