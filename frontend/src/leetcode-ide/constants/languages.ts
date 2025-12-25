export type Language = {
    id: string;
    label: string;
    monaco: string;
  };
  
  export const LANGUAGES: Language[] = [
    { id: "cpp", label: "C++", monaco: "cpp" },
    { id: "python", label: "Python", monaco: "python" },
    { id: "java", label: "Java", monaco: "java" },
    { id: "javascript", label: "JavaScript", monaco: "javascript" },
    { id: "go", label: "Go", monaco: "go" },
    { id: "rust", label: "Rust", monaco: "rust" }
  ];
  
  export const DEFAULT_CODE: Record<string, string> = {
    cpp: `#include <bits/stdc++.h>
  using namespace std;
  int main() {
      return 0;
  }`,
    python: `def main():
      pass
  
  if __name__ == "__main__":
      main()`,
    java: `class Main {
      public static void main(String[] args) {
      }
  }`,
    javascript: `function main() {}
  main();`,
    go: `package main
  func main() {}`,
    rust: `fn main() {}`
  };
  