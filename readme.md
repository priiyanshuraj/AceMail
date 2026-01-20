# AceMail

AceMail is an open-source email automation and cold outreach platform designed to help you run campaigns efficiently. Built with Django, Celery, and Tailwind CSS, it provides a scalable solution for scheduling, personalizing, and tracking emails.

## Features

* **Campaign Management –** Create and schedule multi-stage cold email campaigns

* **Visual Template Builder –** Design responsive email templates easily

* **Contact Management –** Import, organize, and segment contact lists

* **Automated Sending –** Background email processing with Celery + Redis

* **Analytics –** Track sent, failed, and open rates

* **Modern UI –** Clean, responsive interface built with Tailwind CSS

* **Rate Limiting –** Built-in safeguards against spam and quota abuse

## Tech Stack

* **Backend:** Python 3.8+, Django 4.0.4

* **Frontend:** Tailwind CSS, JavaScript, HTML5

* **Task Queue:** Celery 5.2.7, Redis

* **Database:** PostgreSQL


## Installation & Setup
### Prerequisites:

***Python 3.8+***

***Node.js & npm (for Tailwind CSS)***

***Redis (running locally)***
Follow these steps to run this own your local machine.
### 1. Clone the Repository
```bash
git clone https://github.com/priiyanshuraj/acemail.git
cd acemail
```

### 2. Create & Activate Virtual Environment
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```
### 3. Install Dependencies
```bash
pip install -r requirements.txt
```
### 4. Setup Tailwind CSS
```bash
python manage.py tailwind install
```
### 5. Environment Configuration
Create a .env file in the project root:
```bash
DEBUG=1
DOMAIN=
SECRET_KEY=
PROD_SECRET_KEY=
REDIS_PROD_HOST=

EMAIL_HOST=
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=

POSTGRES_URL=
```

### 6. Run Migrations
```bash
python manage.py migrate
```
### 7. Start the Application

Run each command in a separate terminal:

#### Terminal 1 – Django Server
```bash
python manage.py runserver
```

#### Terminal 2 – Tailwind Watcher
```bash
python manage.py tailwind start
```

#### Terminal 3 – Celery Worker
```bash
celery -A email_automation worker -l info
```

### Finally: Access the app at: [http://127.0.0.1:8000]

## Contributing
Contributions are welcome. Please contribute if you want to

**1. Fork the repository**

**2. Create your feature branch**
```bash
git checkout -b feature/NewFeature**
```

**3. Commit your changes**
```bash
git commit -m "Add NewFeature"
```

**4. Push to the branch**
```bash
git push origin feature/NewFeature
```

**5. Open a Pull Request**

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
