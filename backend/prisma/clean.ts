import fs from 'node:fs'; import path from 'node:path';
const db=path.resolve(process.cwd(),'../../data/robo_avaliacao.db');
if(fs.existsSync(db)) fs.unlinkSync(db); if(fs.existsSync(db+'-journal')) fs.unlinkSync(db+'-journal'); if(fs.existsSync(db+'-wal')) fs.unlinkSync(db+'-wal'); if(fs.existsSync(db+'-shm')) fs.unlinkSync(db+'-shm'); console.log('Banco de desenvolvimento removido:',db);
