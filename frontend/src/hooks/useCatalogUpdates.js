import { useEffect, useEffectEvent } from 'react';
import { subscribeCatalog } from '../services/catalogUpdates';

export default function useCatalogUpdates(callback) {
  const update = useEffectEvent(callback);
  useEffect(() => subscribeCatalog(() => update()),[]);
}
