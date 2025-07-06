
## Description

Car Bidding System where mulitple users can bid

Auction creation is also allowed

Runs React using script to render minimal UI setup

Uses RabbitMQ to process bids and Redis events to broadcast events

### API Flow

##### Admin flow (CRUD opns are also made available for easy management)

1. Auction needs to be created first (car name can be provided)

2.  Auction Actions:
    One can activate and end auction



##### END USER flow
1. User needs to be created
2. User email of the created user to generate jwt token
3. Add the token in authorize
4. Use the same JWT in http://localhost:4000/index.html (renders basic UI which show events and bid)
5. Auction ID needs to be entered for participating in an auction
6. Once connected user can place bid


RateLimiting is applied for IP and users

## Project setup

```bash
$ yarn install
```

## Compile and run the project

```bash
$ yarn run start:dev
```

## Run Worker

```bash
$ yarn run worker
```
## Deployment
 Docker file contains services for Postgres, Redis and RabbitMQ

 Run the container using docker compose
