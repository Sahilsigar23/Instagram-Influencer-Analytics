from __future__ import annotations

from typing import List

import cv2
import numpy as np


def extract_keywords_from_image(image_bytes: bytes) -> list[str]:
	image_array = np.frombuffer(image_bytes, dtype=np.uint8)
	img = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
	if img is None:
		return []

	# Simple heuristic tags using color and edge density
	gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
	edges = cv2.Canny(gray, 100, 200)
	edge_ratio = float(np.mean(edges > 0))
	avg_color = np.mean(img.reshape(-1, 3), axis=0)

	tags: list[str] = []
	if avg_color[2] > avg_color[1] and avg_color[2] > avg_color[0]:
		tags.append("warm")
	if avg_color[0] > 150 and avg_color[1] > 150 and avg_color[2] > 150:
		tags.append("bright")
	if edge_ratio < 0.03:
		tags.append("minimal")
	elif edge_ratio > 0.12:
		tags.append("busy")
	return tags


def classify_vibe_from_image(image_bytes: bytes) -> str:
	image_array = np.frombuffer(image_bytes, dtype=np.uint8)
	img = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
	if img is None:
		return "unknown"
	brightness = float(np.mean(cv2.cvtColor(img, cv2.COLOR_BGR2HSV)[:, :, 2]))
	saturation = float(np.mean(cv2.cvtColor(img, cv2.COLOR_BGR2HSV)[:, :, 1]))
	if brightness > 180 and saturation > 90:
		return "energetic"
	if brightness < 90:
		return "moody"
	return "casual"


def quality_indicators(image_bytes: bytes) -> str:
	image_array = np.frombuffer(image_bytes, dtype=np.uint8)
	img = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
	if img is None:
		return "low-confidence"
	gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
	variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
	sharpness = "sharp" if variance > 120.0 else "soft"
	return f"lighting:{int(np.mean(gray))} sharpness:{sharpness}"


