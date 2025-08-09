import Promise from 'when/lib/Promise.js';

if (process.env.NODE_ENV !== 'production')
  import('when/monitor.js').then(monitor => monitor(Promise));

export default Promise;
