import { spawn } from 'child_process';
import path from 'path';

export class ResumeService {
  static async parseResume(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // Path to python script
      const scriptPath = path.join(process.cwd(), 'python', 'resume_parser.py');
      
      const processEnv = {
        ...process.env,
        // Ensure GITHUB_TOKEN is passed to Python
        GITHUB_TOKEN: process.env.GITHUB_TOKEN || ''
      };

      const pyProcess = spawn('python3', [scriptPath, filePath], {
        env: processEnv
      });

      let dataString = '';
      let errorString = '';

      pyProcess.stdout.on('data', (data) => {
        dataString += data.toString();
      });

      pyProcess.stderr.on('data', (data) => {
        errorString += data.toString();
      });

      pyProcess.on('close', (code) => {
        if (code !== 0) {
          console.error("Python Error:", errorString);
          return reject(new Error(`Resume parser exited with code ${code}`));
        }

        try {
          // Parse the JSON output from Python
          const result = JSON.parse(dataString);
          resolve(result);
        } catch (err) {
          console.error("JSON Parse Error:", dataString);
          reject(new Error("Failed to parse Python script output"));
        }
      });
    });
  }
}