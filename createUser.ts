import * as mysql from "mysql2/promise";
import * as readline from "readline";


// Utility function to prompt for input
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function createUser(): Promise<void> {
  try {
    const username: string = await askQuestion("👤 Enter a username: ");

    const connection = await mysql.createConnection({
      host: "185.198.27.242",
      user: "root",
      password: "AMINOS2025",
      database: "warmup",
      port: 3306,
    });

    const [result] = await connection.execute<mysql.ResultSetHeader>(
      "INSERT INTO Accounts (username) VALUES (?)",
      [username]
    );

    console.log(`✅ User '${username}' created with ID: ${result.insertId}`);
    await connection.end();
  } catch (err: any) {
    console.error("❌ Error creating user:", err.message);
  }
}

createUser();
