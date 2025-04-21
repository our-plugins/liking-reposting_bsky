import * as mysql from "mysql2/promise";

async function testConnection() {
  const connection = await mysql.createConnection({
    host: '185.198.27.242',    
  user: 'root',
  password: 'AMINOS2025',
    database: 'warmup',
    port: 3306, // or change if your MariaDB uses a custom port
  });

  console.log('✅ Connected to the database!');

  const [rows] = await connection.execute('SELECT * FROM Accounts');
  console.log('📦 Accounts:', rows);

  await connection.end();
}

testConnection().catch((err) => {
  console.error('❌ DB Connection Failed:', err.message);
});
