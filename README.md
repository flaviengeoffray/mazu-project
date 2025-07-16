# mazu-project

```bash
cd cv

docker build -t fruit-classifier .

docker run -p 8080:80 fruit-classifier
```

```bash
cd frontend

npm install

npm start
```



```bash
cd proxy

echo ENDPOINT_URL=<your_url>
ENDPOINT_AUTH_TOKEN=<your_token> > .env

npm install

npm run dev
```
