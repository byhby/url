import os
import unittest
from shortener import Shortener

class TestShortener(unittest.TestCase):
    def setUp(self):
        self.test_db = os.path.join(os.path.dirname(__file__), "data", "test_urls.json")
        if os.path.exists(self.test_db):
            os.remove(self.test_db)
        self.shortener = Shortener(data_file=self.test_db)

    def tearDown(self):
        if os.path.exists(self.test_db):
            os.remove(self.test_db)

    def test_user_agent_filtering(self):
        chrome_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
        safari_ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) Mobile/15E148 Safari/604.1"
        insta_ua = "Instagram 225.0.0.19.115"
        fb_ua = "Mozilla/5.0 [FBAN/FBIOS;FBDV/iPhone12,1]"
        telegram_ua = "TelegramBot (like TwitterBot)"

        self.assertFalse(self.shortener.is_allowed_in_app_browser(chrome_ua))
        self.assertFalse(self.shortener.is_allowed_in_app_browser(safari_ua))
        self.assertTrue(self.shortener.is_allowed_in_app_browser(insta_ua))
        self.assertTrue(self.shortener.is_allowed_in_app_browser(fb_ua))
        self.assertTrue(self.shortener.is_allowed_in_app_browser(telegram_ua))

    def test_create_and_edit_url(self):
        record = self.shortener.create_short_url("https://github.com", validity_days=10)
        self.assertTrue(7 <= len(record["code"]) <= 10)
        self.assertEqual(record["destinationUrl"], "https://github.com")
        self.assertEqual(record["validityDays"], 10)

        updated = self.shortener.edit_short_url(record["code"], "https://gitlab.com")
        self.assertEqual(updated["destinationUrl"], "https://gitlab.com")

if __name__ == "__main__":
    unittest.main()
