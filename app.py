from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import requests
import io
import json
from datetime import datetime
import os

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST", "OPTIONS"]}})

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Store generation history in memory (for production, use a database)
generation_history = []

@app.route('/')
def index():
    """Serve the main HTML page"""
    return render_template('index.html')

@app.route('/api/generate', methods=['POST'])
def generate_image():
    """Handle image generation requests"""
    try:
        data = request.json
        prompt = data.get('prompt', '').strip()
        api_key = data.get('apiKey', '').strip()
        style = data.get('style', 'realistic')
        size = data.get('size', '512x512')
        quality_steps = data.get('qualitySteps', 30)
        
        if not prompt:
            return jsonify({'error': 'Prompt is required'}), 400
        
        if not api_key:
            return jsonify({'error': 'API key is required'}), 400
        
        # Enhance prompt based on style
        enhanced_prompt = enhance_prompt(prompt, style)
        
        # Call Hugging Face API
        image_data = call_hugging_face_api(
            enhanced_prompt, 
            api_key, 
            size, 
            quality_steps
        )
        
        if not image_data:
            return jsonify({'error': 'Failed to generate image'}), 500
        
        # Store in history
        generation_record = {
            'id': int(datetime.now().timestamp() * 1000),
            'prompt': prompt,
            'enhanced_prompt': enhanced_prompt,
            'style': style,
            'size': size,
            'timestamp': datetime.now().isoformat()
        }
        generation_history.append(generation_record)
        
        # Convert to base64 for response
        import base64
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{image_base64}',
            'id': generation_record['id']
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/history', methods=['GET'])
def get_history():
    """Get generation history"""
    return jsonify(generation_history), 200

@app.route('/api/history/clear', methods=['POST'])
def clear_history():
    """Clear generation history"""
    global generation_history
    generation_history = []
    return jsonify({'success': True}), 200

@app.route('/api/validate-key', methods=['POST', 'OPTIONS'])
def validate_api_key():
    """Validate Hugging Face API key"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.json
        api_key = data.get('apiKey', '').strip()
        
        if not api_key:
            return jsonify({'valid': False, 'error': 'API key is required'}), 400
        
        # Test with a simple API request
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        # Use user info endpoint to validate key
        response = requests.get(
            'https://huggingface.co/api/whoami-v2',
            headers=headers,
            timeout=10
        )
        
        is_valid = response.status_code == 200
        
        if is_valid:
            return jsonify({'valid': True, 'message': 'API key is valid!'}), 200
        else:
            return jsonify({'valid': False, 'error': 'Invalid API key'}), 200
        
    except requests.exceptions.Timeout:
        return jsonify({'valid': False, 'error': 'Request timeout. Check your internet connection.'}), 400
    except Exception as e:
        return jsonify({'valid': False, 'error': f'Validation error: {str(e)}'}), 400

def enhance_prompt(prompt, style):
    """Enhance prompt based on selected style"""
    style_enhancements = {
        'realistic': ', photorealistic, high detail, professional photography',
        'artistic': ', artistic, painterly, fine art, masterpiece',
        'cartoon': ', cartoon style, animated, colorful, fun',
        'cyberpunk': ', cyberpunk, neon lights, futuristic, high tech',
        'vintage': ', vintage style, retro, classic, nostalgic'
    }
    
    enhancement = style_enhancements.get(style, '')
    return prompt + enhancement + ', high quality, detailed'

def call_hugging_face_api(prompt, api_key, size, quality_steps):
    """Call Hugging Face API to generate image"""
    models = [
        'runwayml/stable-diffusion-v1-5',
        'stabilityai/stable-diffusion-xl-base-1.0',
        'CompVis/stable-diffusion-v1-4'
    ]
    
    width, height = map(int, size.split('x'))
    
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'inputs': prompt,
        'parameters': {
            'num_inference_steps': quality_steps,
            'guidance_scale': 7.5,
            'width': width,
            'height': height
        }
    }
    
    for model in models:
        try:
            url = f'https://api-inference.huggingface.co/models/{model}'
            response = requests.post(url, headers=headers, json=payload, timeout=120)
            
            if response.status_code == 200:
                return response.content
            
            if response.status_code == 503:
                continue
            
            if response.status_code != 200:
                error_msg = response.text
                print(f"Model {model} error: {error_msg}")
                continue
                
        except requests.exceptions.Timeout:
            print(f"Timeout on model {model}")
            continue
        except Exception as e:
            print(f"Error with model {model}: {str(e)}")
            continue
    
    return None

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)